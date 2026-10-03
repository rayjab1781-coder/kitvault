import { drizzle } from 'drizzle-orm/netlify-db';
import { getDatabase } from '@netlify/database';
import * as schema from './schema';

export const db = drizzle({ client: getDatabase(), schema });
