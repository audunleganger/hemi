# Single image serving the API and the web GUI (DEP-1).

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk AS server
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
COPY shared shared
COPY server server
RUN ./gradlew --no-daemon :server:buildFatJar

FROM eclipse-temurin:21-jre
# The version /api/health reports, set by CI to the release tag or commit (DEP-3). Unset means the source version.
ARG APP_VERSION=""
LABEL org.opencontainers.image.source="https://github.com/audunleganger/hemi"
RUN useradd --system --create-home hemi \
    && mkdir /data && chown hemi /data
WORKDIR /app
COPY --from=server /src/server/build/libs/hemi-server.jar app.jar
COPY --from=web /web/dist web
USER hemi
ENV HEMI_PORT=8080 \
    HEMI_DATA_DIR=/data \
    HEMI_WEB_DIR=/app/web \
    HEMI_VERSION=${APP_VERSION}
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
