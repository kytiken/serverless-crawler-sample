import { APIGatewayProxyHandler, KinesisStreamHandler } from "aws-lambda";
import { Kinesis, DynamoDB } from "aws-sdk";
import { v4 as uuid } from "uuid";
const rp = require("request-promise");

const getPage = (url: string) => {
  return rp.get(url).then(htmlString => {
    return htmlString;
  });
};

const putKinesisStream = (data: string) => {
  const kinesisStreamName = process.env.kinesisStreamName;
  const params: Kinesis.PutRecordInput = {
    Data: data /* required */ /* Strings will be Base-64 encoded on your behalf */,
    PartitionKey: "hello-partition" /* required */,
    StreamName: kinesisStreamName /* required */
  };
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
  const dynamoDb = new DynamoDB.DocumentClient();
  const putParams: DynamoDB.DocumentClient.PutItemInput = {
    TableName: process.env.DYNAMODB_TABLE,
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

export const hello: APIGatewayProxyHandler = async event => {
  const urls = [
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io",
    "http://v150-95-157-102.a096.g.tyo1.static.cnode.io"
  ];
  const revision = new Date().getTime();
  for (const url of urls) {
    const data = {
      url,
      revision
    };
    await putKinesisStream(JSON.stringify(data));
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      input: event
    })
  };
};

export const kinesisoutput: KinesisStreamHandler = async event => {
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
