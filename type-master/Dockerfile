# Stage 1: Build
FROM maven:3.8.5-openjdk-17 AS build
# Set the working directory inside the container
WORKDIR /app
COPY . .
# Compile the code and download dependencies
RUN mvn clean compile dependency:copy-dependencies -DskipTests

# Stage 2: Run
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app

# Copy the compiled classes and the copied dependencies from the build stage
COPY --from=build /app/target/classes /app/classes
COPY --from=build /app/target/dependency /app/dependency

EXPOSE 8080

# We set the classpath to include our classes and all dependency jars
# Then we call the main class directly
ENTRYPOINT ["java", "-cp", "classes:dependency/*", "com.typemaster.typemaster.TypeMasterApplication"]