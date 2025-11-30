import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import inventoryRoutes from './modules/inventory/http/inventory.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/inventory', inventoryRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) =&gt; {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () =&gt; {
  console.log(`Nuru API listening on port ${port}`);
});