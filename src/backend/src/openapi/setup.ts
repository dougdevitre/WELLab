import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';
import { openApiSpec } from './spec';

const router = Router();

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WELLab API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    filter: true,
    tagsSorter: 'alpha',
  },
}));

// Serve raw spec as JSON
router.get('/spec.json', (_req, res) => {
  res.json(openApiSpec);
});

export { router as swaggerRouter };
