FROM maven:3.8.7-eclipse-temurin-17-focal as build

WORKDIR /app

COPY pom.xml .
COPY src ./src
# Build the application using Maven
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jdk-focal as main
# Set the working directory in the container
WORKDIR /app
# Copy the built JAR file from the previous stage to the container
COPY --from=build /app/target/gateway-0.0.1-SNAPSHOT.jar .

# Set the command to run the application
CMD ["java", "-jar", "gateway-0.0.1-SNAPSHOT.jar"]