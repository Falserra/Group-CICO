# CiCo API: PHP 8.2 + Apache. Built by Render from render.yaml (see docs/DEPLOY.md).
FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod headers \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf '%s\n' \
        'ServerTokens Prod' \
        'ServerSignature Off' \
        '<Directory /var/www/html>' \
        '    Options -Indexes' \
        '    AllowOverride All' \
        '</Directory>' > /etc/apache2/conf-available/cico.conf \
    && a2enconf cico

COPY . /var/www/html/
RUN chown -R www-data:www-data /var/www/html

# Render tells the container which port to listen on through $PORT (Apache's default is 80).
CMD ["sh", "-c", "sed -ri \"s/Listen 80/Listen ${PORT:-80}/\" /etc/apache2/ports.conf && sed -ri \"s/<VirtualHost \\*:80>/<VirtualHost *:${PORT:-80}>/\" /etc/apache2/sites-available/000-default.conf && exec apache2-foreground"]
