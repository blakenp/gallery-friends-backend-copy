import { MongoClient, Db } from 'mongodb';

export const uri = Buffer.from(process.env.MONGODB_URI as string, 'base64').toString();
export const client = new MongoClient(uri);

export async function connectToDatabase(): Promise<Db> {
  console.log('before')
  await client.connect();
  console.log('after connection')
  return client.db(process.env.MONGODB_DB); // Replace with your actual database name
}
