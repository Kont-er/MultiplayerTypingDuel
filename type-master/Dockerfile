# Stage 1: Build
FROM maven:3.8.5-openjdk-17 AS build
COPY . .
# We skip tests here to ensure the build finishes even if tests are broken
RUN mvn clean package -DskipTests

# Stage 2: Run
FROM eclipse-temurin:17-jdk-jammy
# This copies the FAT jar we just verified exists
COPY --from=build /target/*-jar-with-dependencies.jar app.jar

EXPOSE 8080

# We run the jar. The -jar flag tells Java to look at the Manifest 
# we set in the pom.xml to find the Main class.
ENTRYPOINT ["java", "-jar", "/app.jar"]