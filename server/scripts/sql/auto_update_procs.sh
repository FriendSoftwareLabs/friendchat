#!/bin/bash
echo "dbHost $dbHost"
echo "dbSock $dbSock"
if [ -z "$dbSock" ]; then
	connStr="--host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPass --database=$dbName"
else
	connStr="--socket=$dbSock --user=$dbUser --password=$dbPass --database=$dbName"
fi

echo "connStr $connStr"
mysql $connStr \
	--execute="SOURCE $procsPath"
