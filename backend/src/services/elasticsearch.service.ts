import { Client } from "@elastic/elasticsearch";

const node = process.env.ELASTICSEARCH_URL || "http://localhost:9200";

export const elasticsearch = new Client({ node });

export const indexEmailEvent = async (event: {
  emailJobId: string;
  campaignId: string;
  leadId: string;
  status: string;
  email?: string;
  error?: string;
  timestamp: string;
}): Promise<void> => {
  try {
    await elasticsearch.index({
      index: "reachinbox-email-events",
      document: event
    });
  } catch (error) {
    console.warn(
      "[Elasticsearch] Event indexing skipped:",
      error instanceof Error ? error.message : String(error)
    );
  }
};
