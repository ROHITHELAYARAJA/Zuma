# Mock Gateway

This is a lightweight SpringBoot application which mocks ABDM Gateway to provide responses and issue callback urls to Wrapper. This can be handy when actual ABDM Gateway sandbox is down.

### Steps to use lightweight gateway:
- If you are running Wrapper then stop the application. Make the following changes to application.properties:
Uncomment this line `gatewayBaseUrl=http://gateway:8090` and `comment gatewayBaseUrl=https://dev.abdm.gov.in/gateway`
- Run `docker-compose -f compose-wrapper-mockgateway.yaml up --build`

### Limitations
- This application does not persist any of the patient's contexts such as care contexts, etc. Although, it does store in memory so if you restart this application, all of those contexts will be lost.
- Since there will be no interaction with PHR, user will have to provide HIP and Care Context details in the request object while initiating consent.
- This application has been designed to test out happiest paths. It might not throw errors where it is supposed to.
