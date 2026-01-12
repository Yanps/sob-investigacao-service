import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub();
const topicName = "sob-processing-jobs";

export async function publishProcessingJob(payload: {
  jobId: string;
  traceId: string;
}) {
  const dataBuffer = Buffer.from(JSON.stringify(payload));

  await pubsub.topic(topicName).publishMessage({
    data: dataBuffer,
  });
}
