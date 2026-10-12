import express from 'express';
import type { Request, Response } from 'express';
import db from './db/db_init.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to Cloud Storage App!');
});

async function main() {
  try {
    await db.execute('SELECT 1');
    console.log('\n✅ Database connected successfully!');

    app.listen(process.env.PORT, () => {
      console.log(`🚀 App server (${process.env.NODE_ENV}) is running on http://localhost:${process.env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

main();