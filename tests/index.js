require('..');
const App = require('yeps');
const srv = require('yeps-server');
const error = require('yeps-error');
const chai = require('chai');
const chaiHttp = require('chai-http');

const { expect } = chai;

chai.use(chaiHttp);

let app;
let server;

const UserSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required.'],
  },
});


describe('YEPS mysql test', () => {
  beforeEach(() => {
    app = new App();
    app.then(error());
    server = srv.createHttpServer(app);
  });

  afterEach(() => {
    server.close();
  });

  after(() => {

  });

  it('should test User', async () => {
    let isTestFinished1 = false;
    let isTestFinished2 = false;

    await chai.request(server)
      .get('/')
      .send()
      .then((res) => {
        expect(res).to.have.status(200);
        isTestFinished2 = true;
      });

    expect(isTestFinished1).is.true;
    expect(isTestFinished2).is.true;
  });
});
