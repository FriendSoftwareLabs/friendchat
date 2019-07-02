#!/bin/bash
connStr="--host=$dbHost --port=3306 --user=$dbUser --password=$dbPass --database=$dbName"
mysql $connStr \
	--execute="SOURCE $procsPath"
