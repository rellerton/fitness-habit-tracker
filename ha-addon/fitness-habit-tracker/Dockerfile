ARG BUILD_FROM=ghcr.io/rellerton/fitness-habit-tracker:v1.0.2
FROM ${BUILD_FROM}

# Add nginx + bash (node is already in your base image)
RUN apk add --no-cache nginx bash

# Add ingress nginx config + HA run script
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3000
CMD ["/run.sh"]
