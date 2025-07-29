describe('API Tests', () => {
    it('should return a 200 OK response for the root endpoint', () => {
      cy.request('GET', '/')
        .its('status')
        .should('eq', 200);
    });
  
    it('should return a 200 OK response and a valid response for a valid query', () => {
      cy.request('POST', '/q', { input: 'What is machine learning?' })
        .then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property('response');
        });
    });
  
    it('should return a 400 Bad Request response for a request with no input', () => {
      cy.request({
        method: 'POST',
        url: '/q',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });
  
    it('should return a warning message for a non-research-related query', () => {
      cy.request('POST', '/q', { input: 'What is the weather today?' })
        .then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.response).to.include('I specialize in research topics');
        });
    });
  });
  