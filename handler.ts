import { APIGatewayProxyHandler, KinesisStreamHandler } from "aws-lambda";
import { Kinesis } from "aws-sdk";

export const hello: APIGatewayProxyHandler = async event => {
  const kinesis = new Kinesis();
  const kinesisStreamName = process.env.kinesisStreamName;
  const params: Kinesis.PutRecordInput = {
    Data:
      "hello" /* required */ /* Strings will be Base-64 encoded on your behalf */,
    PartitionKey: "hello-partition" /* required */,
    StreamName: kinesisStreamName /* required */
  };
  await kinesis
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
  return {
    statusCode: 200,
    body: JSON.stringify({
      message:
        "Go Serverless Webpack (Typescript) v1.0! Your function executed successfully!",
      input: event
    })
  };
};

export const kinesisoutput: KinesisStreamHandler = async event => {
  event.Records.forEach(record => {
    console.log(`record.kinesis.data: ${record.kinesis.data}`);
    console.log(
      `record.kinesis.data(decoded): ${new Buffer(
        record.kinesis.data,
        "base64"
      ).toString()}`
    );
  });
};
