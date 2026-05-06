# Stage 1: Build
FROM maven:3.8.5-openjdk-17 AS build
COPY . .
RUN mvn clean package -DskipTests

# Stage 2: Run
FROM eclipse-temurin:17-jdk-jammy

# We copy your big JAR and rename it to app.jar for the container
COPY --from=build /target/type-master-0.0.1-SNAPSHOT-jar-with-dependencies.jar app.jar

EXPOSE 8080

# MANUAL RUN: We specify the classpath (-cp) and the exact class to run
# Note: Ensure the package path here is exactly what is at the top of your .java file
ENTRYPOINT ["java", "-cp", "app.jar", "com.typemaster.typemaster.TypeMasterApplication"]