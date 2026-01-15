ARG BUILD_FROM
FROM ${BUILD_FROM}

# Add nginx + bash
RUN apk add --no-cache nginx bash

# Copy files from THIS folder (build context = ha-addon/fitness-habit-tracker)
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3000
CMD ["/run.sh"]
