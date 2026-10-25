import express from 'express';
import type { Request, Response } from 'express';
import db from './db/db_init.js';
import dotenv from 'dotenv';
import { pageRoutes, publicRoutes, userRoutes } from './routes/index.js';
import path from 'path';
import cookieParser from 'cookie-parser';

dotenv.config();
const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/', pageRoutes);
app.use('/', publicRoutes);
app.use('/user', userRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to Cloudiva Server!');
});

async function main() {
  try {
    await db.execute('SELECT 1');
    console.log('\n✅ Database connected successfully!');

    app.listen(process.env.PORT, () => {
      console.log(`🚀 App server (${process.env.NODE_ENV}) is running on port: ${process.env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

main();