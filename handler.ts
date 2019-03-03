import { APIGatewayProxyHandler } from "aws-lambda";
import { SQS, DynamoDB } from "aws-sdk";
import { v4 as uuid } from "uuid";
const rp = require("request-promise");
const dynamoDb = new DynamoDB.DocumentClient();

const getPage = (url: string) => {
  return rp.get(url).then(htmlString => {
    return htmlString;
  });
};

const putDynamoDb = item => {
  const newId = uuid();
  const putParams: DynamoDB.DocumentClient.PutItemInput = {
    TableName: process.env.PAGE_DYNAMODB_TABLE,
    Item: {
      id: newId,
      ...item
    }
  };
  return dynamoDb
    .put(putParams)
    .promise()
    .then(data => {
      console.log(data);
    })
    .catch(err => {
      console.log(err);
    });
};

const getQueueUrl = context => {
  const accountId = context.invokedFunctionArn.split(":")[4];
  const queueName = process.env.SLOT_QUEUE_NAME;
  var params = {
    QueueName: queueName /* required */,
    QueueOwnerAWSAccountId: accountId
  };
  return new SQS().getQueueUrl(params).promise();
};

const putSqsMessage = (queueUrl: string, data: string) => {
  const sqs = new SQS();
  const params = {
    MessageBody: data /* required */,
    QueueUrl: queueUrl /* required */
  };
  return sqs
    .sendMessage(params)
    .promise()
    .then(value => {
      console.log(value);
    })
    .catch(reason => {
      console.log(reason);
    });
};

export const addUrl: APIGatewayProxyHandler = async event => {
  const url = JSON.parse(event.body).url;
  const item = {
    url
  };

  const putParams: DynamoDB.DocumentClient.PutItemInput = {
    TableName: process.env.URL_DYNAMODB_TABLE,
    Item: item
  };
  return await dynamoDb
    .put(putParams)
    .promise()
    .then(data => {
      console.log(data);
      return {
        statusCode: 200,
        body: JSON.stringify({
          item
        })
      };
    })
    .catch(err => {
      console.log(err);
      return {
        statusCode: 200,
        body: JSON.stringify(err)
      };
    });
};

export const slot: APIGatewayProxyHandler = async (_, context) => {
  const scanParams: DynamoDB.DocumentClient.ScanInput = {
    TableName: process.env.URL_DYNAMODB_TABLE
  };
  const urls = await dynamoDb
    .scan(scanParams)
    .promise()
    .then(data => {
      return data.Items.map(item => {
        console.log(item);
        return item.url;
      });
    });
  console.log(`urls: ${urls}`);
  const revision = new Date().getTime();
  const queueUrl = (await getQueueUrl(context)).QueueUrl;
  for (const url of urls) {
    const data = {
      url,
      revision
    };
    console.log(`JSON.stringify(data): ${JSON.stringify(data)}`);
    await putSqsMessage(queueUrl, JSON.stringify(data));
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      revision
    })
  };
};

export const crawl = async event => {
  for (const record of event.Records) {
    const data = JSON.parse(record.body);
    const html = await getPage(data.url);
    const crawled_at = new Date().toISOString();
    const item = {
      url: data.url,
      revision: data.revision,
      html,
      crawled_at
    };
    await putDynamoDb(item);
  }
};
