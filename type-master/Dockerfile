# Build Stage
FROM maven:3.8.5-openjdk-17 AS build
COPY . .
RUN mvn clean package -DskipTests

# Run Stage
FROM eclipse-temurin:17-jdk-jammy
# Use the EXACT name you just confirmed exists
COPY --from=build /target/type-master-0.0.1-SNAPSHOT-jar-with-dependencies.jar app.jar

EXPOSE 8080

# This runs the JAR using its internal Manifest
ENTRYPOINT ["java", "-jar", "/app.jar"]