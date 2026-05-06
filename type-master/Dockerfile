# Build stage
FROM maven:3.8.5-openjdk-17 AS build
COPY . .
RUN mvn clean package -DskipTests

# Run stage (Using Temurin instead of the deprecated openjdk image)
FROM eclipse-temurin:17-jdk-jammy
# Copy the fat jar produced by the assembly plugin
COPY --from=build /target/*-jar-with-dependencies.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]