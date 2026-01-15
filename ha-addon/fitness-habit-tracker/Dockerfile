ARG BUILD_FROM
FROM ${BUILD_FROM}

RUN apk add --no-cache nginx bash

COPY ha-addon/fitness-habit-tracker/nginx.conf /etc/nginx/http.d/default.conf
COPY ha-addon/fitness-habit-tracker/run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3000
CMD ["/run.sh"]
