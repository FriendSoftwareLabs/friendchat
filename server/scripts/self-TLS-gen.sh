#!/bin/sh
# pass the domain you wish to generate the cert for
DOMAIN_STR="/CN=$1"
echo $DOMAIN_STR

cd ../
mkdir TLS
cd TLS/
openssl req -nodes -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 999 -subj '/CN=example.com'
