import { Client } from '@elastic/elasticsearch';
import { Job } from './lib/Job';
import { getEsClient } from './lib/elasticsearch';
import { getEnvConfig } from './lib/get_env';
import { deleteIndexPattern, getIndexPatternId } from './lib/kibana';

export async function reset(jobs: Job[]) {
  const envConfig = getEnvConfig();
  const esClient = getEsClient(envConfig);

  await Promise.all(
    jobs.flatMap((job) => {
      console.log(`Job: "${job.indexTemplateName}": Resetting`);
      const indexPatternId = getIndexPatternId(job.indexTemplateName);

      return [
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        deleteIndexPattern(envConfig, indexPatternId),
        deleteDataStreamAndIndexTemplate(esClient, job.indexTemplateName),
      ];
    })
  );
}

async function deleteDataStreamAndIndexTemplate(
  esClient: Client,
  indexTemplateName: string
) {
  // delete datasteam if exists
  try {
    await esClient.indices.getDataStream({ name: indexTemplateName });
    await esClient.indices.deleteDataStream({ name: indexTemplateName });
    console.log(`Job "${indexTemplateName}": Deleted datastream`);
  } catch (e) {
    if (e.meta.statusCode !== 404) {
      console.log(
        `Job "${indexTemplateName}": Datastream could not be deleted`
      );
      throw e;
    }
  }

  // delete indices
  await esClient.indices.delete({ index: `${indexTemplateName}*` });

  // delete template index if exists
  const res = await esClient.indices.existsIndexTemplate({
    name: indexTemplateName,
  });

  if (res.body) {
    await esClient.indices.deleteIndexTemplate({ name: indexTemplateName });
    console.log(`Job "${indexTemplateName}": Index template deleted`);
  }
}
