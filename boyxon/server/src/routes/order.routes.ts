import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createOrderSchema, quoteOrderSchema, cancelOrderSchema, reviewSchema, orderIdParamSchema } from '../validators/order.validator';
import * as c from '../controllers/order.controller';

export const orderRouter = Router();

orderRouter.use(requireAuth);
orderRouter.post('/', validate({ body: createOrderSchema }), c.createOrder);
// Diqqat: `/:id` dan OLDIN turishi shart, aks holda "quote" ID deb qabul qilinadi.
orderRouter.post('/quote', validate({ body: quoteOrderSchema }), c.quoteOrder);
orderRouter.get('/:id', validate({ params: orderIdParamSchema }), c.getOrder);
orderRouter.patch(
  '/:id/cancel',
  validate({ params: orderIdParamSchema, body: cancelOrderSchema }),
  c.cancelOrder,
);
orderRouter.post(
  '/:id/review',
  validate({ params: orderIdParamSchema, body: reviewSchema }),
  c.reviewOrder,
);
