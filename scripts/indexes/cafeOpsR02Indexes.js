import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.resolve(__dirname, '../../config/cafeOpsR02Indexes.json');

export const CAFE_OPS_R02_INDEXES = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

export default CAFE_OPS_R02_INDEXES;
