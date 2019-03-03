import { APIGatewayProxyHandler, KinesisStreamHandler } from "aws-lambda";
import { Kinesis, DynamoDB } from "aws-sdk";
import { v4 as uuid } from "uuid";
const rp = require("request-promise");
const dynamoDb = new DynamoDB.DocumentClient();

const getPage = (url: string) => {
  return rp.get(url).then(htmlString => {
    return htmlString;
  });
};

const putKinesisStream = (data: string) => {
  console.log(`putKinesisStream - data: ${data}`);
  const params: Kinesis.PutRecordInput = {
    Data: data /* required */ /* Strings will be Base-64 encoded on your behalf */,
    PartitionKey: process.env.SLOT_KINESIS_STREAM_PARTITION_KEY /* required */,
    StreamName: process.env.SLOT_KINESIS_STREAM_NAME /* required */
  };
  console.log(params);
  const kinesis = new Kinesis();
  return kinesis
    .putRecord(params)
    .promise()
    .then(value => {
      console.log(`ShardId: ${value.ShardId}`);
      console.log(`EncryptionType: ${value.EncryptionType}`);
      console.log(`SequenceNumber: ${value.SequenceNumber}`);
    })
    .catch(reason => {
      console.log(reason);
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

export const slot: APIGatewayProxyHandler = async () => {
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
  for (const url of urls) {
    const data = {
      url,
      revision
    };
    console.log(`JSON.stringify(data): ${JSON.stringify(data)}`);
    console.log(`JSON.stringify(data): ${JSON.stringify(data)}`);
    await putKinesisStream(JSON.stringify(data));
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      revision
    })
  };
};

export const crawl: KinesisStreamHandler = async event => {
  for (const record of event.Records) {
    console.log(`record.kinesis.data: ${record.kinesis.data}`);
    const data = JSON.parse(
      new Buffer(record.kinesis.data, "base64").toString()
    );
    console.log(`record.kinesis.data(decoded): ${data.url}`);
    const html = await getPage(data.url);
    console.log(`html: ${html}`);
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
