ARG BUILD_FROM=ghcr.io/rellerton/fitness-habit-tracker:v1.0.2
FROM ${BUILD_FROM}

# Add nginx + bash (node is already in your base image)
RUN apk add --no-cache nginx bash

# Add ingress nginx config + HA run script
COPY ha-addon/fitness-habit-tracker/nginx.conf /etc/nginx/http.d/default.conf
COPY ha-addon/fitness-habit-tracker/run.sh /run.sh
COPY ha-addon/fitness-habit-tracker/services.d /etc/services.d
RUN chmod a+x /run.sh

EXPOSE 3000
CMD ["/run.sh"]
