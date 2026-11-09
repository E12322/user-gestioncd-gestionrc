# ---- Etape 1 : compilation (Maven + JDK 17) ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- Etape 2 : execution (JRE 17, sans droits root) ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
RUN addgroup -S app && adduser -S app -G app && chown app:app app.jar
USER app
# Offre gratuite : 512 Mo de RAM. On borne le tas Java pour que le conteneur ne soit pas tue.
ENV JAVA_TOOL_OPTIONS="-Xmx300m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m"
ENV PORT=4005
EXPOSE 4005
# Render fournit PORT ; en local, 4005 par defaut.
CMD ["sh", "-c", "java -Dserver.port=${PORT:-4005} -jar app.jar"]
