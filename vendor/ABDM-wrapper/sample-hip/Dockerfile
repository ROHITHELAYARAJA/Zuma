FROM gradle:8.5-jdk17 AS build
WORKDIR /source
COPY . .
RUN gradle bootJar -x test --no-daemon
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /source/build/libs/*-SNAPSHOT.jar /app/hip.jar
COPY --from=build /source/src/main/resources/*.json /app/fixtures/
ENTRYPOINT ["java","-jar","/app/hip.jar"]
