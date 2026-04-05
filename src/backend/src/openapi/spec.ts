/**
 * OpenAPI 3.0 specification for the WELLab API.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'WELLab API',
    version: '1.0.0',
    description:
      'AI-Enabled Research & Impact Platform for the WELLab at Washington University in St. Louis. ' +
      'Operationalizes lifespan wellbeing science with four AI modules: Emotional Dynamics, ' +
      'Behavioral Health, Lifespan Trajectories, and Cognitive Health & Dementia Prevention.',
    contact: { name: 'WELLab', url: 'https://wellbeing.wustl.edu' },
    license: { name: 'Proprietary', url: 'https://wellbeing.wustl.edu/license' },
  },
  servers: [
    { url: 'http://localhost:3001/api/v1', description: 'Local development' },
    { url: 'https://api-staging.wellab.wustl.edu/api/v1', description: 'Staging' },
    { url: 'https://api.wellab.wustl.edu/api/v1', description: 'Production' },
  ],
  tags: [
    { name: 'Participants', description: 'Participant CRUD operations' },
    { name: 'Observations', description: 'EMA / experience sampling data' },
    { name: 'Emotional Dynamics', description: 'Emotion coupling & volatility analysis' },
    { name: 'Health', description: 'Behavioral & physiological health engine' },
    { name: 'Lifespan', description: 'Lifespan trajectory analysis' },
    { name: 'Cognitive', description: 'Cognitive health & dementia prevention' },
    { name: 'Interventions', description: 'Intervention management' },
    { name: 'Insights', description: 'AI-generated insights (Claude API)' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cognito JWT token',
      },
    },
    schemas: {
      Participant: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'P-00001' },
          externalId: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date' },
          enrollmentDate: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['active', 'paused', 'withdrawn', 'completed'] },
          cohort: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      Observation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          participantId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          type: { type: 'string' },
          measures: { type: 'object', example: { positive_affect: 3.5, negative_affect: 1.2 } },
          context: { type: 'object' },
          source: { type: 'string', enum: ['ema', 'wearable', 'clinical', 'self_report'] },
        },
      },
      HealthRecord: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          participantId: { type: 'string' },
          recordDate: { type: 'string', format: 'date-time' },
          domain: { type: 'string', enum: ['physical', 'behavioral', 'physiological', 'sleep'] },
          metrics: { type: 'object' },
          source: { type: 'string' },
        },
      },
      EmotionalDynamicsResult: {
        type: 'object',
        properties: {
          participantId: { type: 'string' },
          couplingType: { type: 'string', enum: ['positive', 'negative', 'decoupled', 'complex'] },
          couplingStrength: { type: 'number', minimum: -1, maximum: 1 },
          volatilityIndex: { type: 'number' },
          trendDirection: { type: 'string', enum: ['improving', 'stable', 'declining'] },
          riskFlag: { type: 'boolean' },
          computedAt: { type: 'string', format: 'date-time' },
        },
      },
      CognitiveAssessment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          participantId: { type: 'string' },
          assessmentDate: { type: 'string', format: 'date-time' },
          cognitiveScore: { type: 'number' },
          domainScores: { type: 'object' },
          riskScore: { type: 'number', minimum: 0, maximum: 1 },
          riskCategory: { type: 'string', enum: ['low', 'moderate', 'high', 'very_high'] },
          protectiveFactors: { type: 'array', items: { type: 'object' } },
        },
      },
      Intervention: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          participantId: { type: 'string' },
          type: { type: 'string', enum: ['coaching', 'activity_prompt', 'psychoeducation', 'referral'] },
          targetDomain: { type: 'string' },
          content: { type: 'object' },
          status: { type: 'string', enum: ['pending', 'delivered', 'completed', 'dismissed'] },
          deliveredAt: { type: 'string', format: 'date-time' },
        },
      },
      Insight: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', enum: ['strength', 'pattern', 'growth-area'] },
          title: { type: 'string' },
          body: { type: 'string' },
          confidenceLevel: { type: 'string', enum: ['high', 'moderate', 'low'] },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
    },
    parameters: {
      PageParam: { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      PageSizeParam: { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
      SortByParam: { name: 'sortBy', in: 'query', schema: { type: 'string' } },
      SortOrderParam: { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/participants': {
      get: {
        tags: ['Participants'],
        summary: 'List all participants',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/PageSizeParam' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'paused', 'withdrawn', 'completed'] } },
          { name: 'cohort', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Paginated list of participants',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Participant' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } } } },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        },
      },
      post: {
        tags: ['Participants'],
        summary: 'Create a participant',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Participant' } } } },
        responses: {
          201: { description: 'Participant created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Participant' } } } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        },
      },
    },
    '/participants/{id}': {
      get: {
        tags: ['Participants'],
        summary: 'Get participant by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Participant details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Participant' } } } } } },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        },
      },
      put: {
        tags: ['Participants'],
        summary: 'Update participant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Participant' } } } },
        responses: {
          200: { description: 'Participant updated' },
          404: { description: 'Not found' },
        },
      },
    },
    '/participants/{id}/observations': {
      get: {
        tags: ['Observations'],
        summary: 'List observations for participant',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/PageSizeParam' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Paginated observations' } },
      },
      post: {
        tags: ['Observations'],
        summary: 'Submit a new EMA observation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Observation' } } } },
        responses: { 201: { description: 'Observation recorded' } },
      },
    },
    '/participants/{id}/emotional-dynamics': {
      get: {
        tags: ['Emotional Dynamics'],
        summary: 'Get emotion coupling and volatility for participant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Emotional dynamics result', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/EmotionalDynamicsResult' } } } } } } },
      },
    },
    '/emotional-dynamics/analyze': {
      post: {
        tags: ['Emotional Dynamics'],
        summary: 'Run coupling analysis on submitted data',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { participantId: { type: 'string' }, observations: { type: 'array', items: { $ref: '#/components/schemas/Observation' } } } } } } },
        responses: { 200: { description: 'Analysis results', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/EmotionalDynamicsResult' } } } } } } },
      },
    },
    '/participants/{id}/health-records': {
      get: {
        tags: ['Health'],
        summary: 'List health records for participant',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/PageSizeParam' },
          { name: 'domain', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated health records' } },
      },
    },
    '/health/causal-analysis': {
      post: {
        tags: ['Health'],
        summary: 'Run causal inference analysis on wellbeing-health relationship',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { treatment: { type: 'string' }, outcome: { type: 'string' }, confounders: { type: 'array', items: { type: 'string' } }, data: { type: 'array', items: { type: 'object' } } } } } } },
        responses: { 200: { description: 'Causal analysis results' } },
      },
    },
    '/participants/{id}/trajectory': {
      get: {
        tags: ['Lifespan'],
        summary: 'Get lifespan trajectory and archetype for participant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Trajectory and cluster assignment' } },
      },
    },
    '/lifespan/cluster-analysis': {
      post: {
        tags: ['Lifespan'],
        summary: 'Run trajectory clustering on cohort data',
        responses: { 200: { description: 'Cluster analysis results' } },
      },
    },
    '/participants/{id}/cognitive': {
      get: {
        tags: ['Cognitive'],
        summary: 'Get cognitive assessment history and risk score',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cognitive assessments with risk', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/CognitiveAssessment' } } } } } } } },
      },
    },
    '/cognitive/risk-assessment': {
      post: {
        tags: ['Cognitive'],
        summary: 'Compute cognitive decline risk for participant data',
        responses: { 200: { description: 'Risk assessment result' } },
      },
    },
    '/participants/{id}/interventions': {
      get: {
        tags: ['Interventions'],
        summary: 'List interventions for participant',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/PageSizeParam' },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated interventions' } },
      },
    },
    '/interventions': {
      post: {
        tags: ['Interventions'],
        summary: 'Create a new intervention',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Intervention' } } } },
        responses: { 201: { description: 'Intervention created' } },
      },
    },
    '/participants/{id}/insights': {
      get: {
        tags: ['Insights'],
        summary: 'Get AI-generated wellbeing insights for participant',
        description: 'Returns strength-framed insights generated by Claude API. Cached for 7 days.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'AI-generated insights', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Insight' } } } } } } } },
      },
    },
    '/insights/trend-narrative': {
      post: {
        tags: ['Insights'],
        summary: 'Generate natural language trend narrative',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Trend narrative' } },
      },
    },
    '/insights/research-summary': {
      post: {
        tags: ['Insights'],
        summary: 'Auto-generate methods and results paragraphs',
        responses: { 200: { description: 'Research summary with methods and results sections' } },
      },
    },
    '/insights/policy-brief': {
      post: {
        tags: ['Insights'],
        summary: 'Generate plain-language policy brief',
        responses: { 200: { description: 'Policy brief with key findings and recommendations' } },
      },
    },
  },
};
