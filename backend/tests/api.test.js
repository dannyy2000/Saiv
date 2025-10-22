const request = require('supertest');

describe('Backend API Tests', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/saiv_test';
    app = require('../src/app');
  });

  describe('Health Checks', () => {
    test('GET / should return API info', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    test('GET /api/health should return OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
    });

    test('GET /api should list endpoints', async () => {
      const res = await request(app).get('/api');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('endpoints');
    });
  });

  describe('Gas Service', () => {
    test('GET /api/gas/status should return service status', async () => {
      const res = await request(app).get('/api/gas/status');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('gaslessEnabled');
    });

    test('GET /api/gas/estimates should return gas estimates', async () => {
      const res = await request(app).get('/api/gas/estimates');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/register/email should require email', async () => {
      const res = await request(app)
        .post('/api/auth/register/email')
        .send({});
      
      expect(res.statusCode).toBe(400);
    });

    test('POST /api/auth/register/wallet should require eoaAddress', async () => {
      const res = await request(app)
        .post('/api/auth/register/wallet')
        .send({});
      
      expect(res.statusCode).toBe(400);
    });

    test('GET /api/auth/profile should require auth', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Groups', () => {
    test('POST /api/groups should require authentication', async () => {
      const res = await request(app)
        .post('/api/groups')
        .send({ name: 'Test Group' });
      
      expect(res.statusCode).toBe(401);
    });

    test('GET /api/groups should require authentication', async () => {
      const res = await request(app).get('/api/groups');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Error Handling', () => {
    test('GET /api/nonexistent should return 404', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.statusCode).toBe(404);
    });
  });
});
