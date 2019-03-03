import { APIGatewayProxyHandler, KinesisStreamHandler } from "aws-lambda";
import { Kinesis } from "aws-sdk";
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
  for (const url of urls) {
    const data = {
      url
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
  }
};
