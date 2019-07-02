#!/bin/sh
read -p "DB name: " DB
read -p "DB user: " USER
read -p "DB pass: " PASS

# backup
mysqldump -u$USER -p$PASS --add-drop-table $DB > bak.sql

# change database
mysql -u$USER -p$PASS --database=$DB \
    --execute "ALTER DATABASE $DB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;"
    
# change tables and fields
mysql -u$USER -p$PASS --database=$DB --execute "SOURCE unicode.sql"

# repair
mysqlcheck -u$USER -p$PASS --auto-repair --optimize $DB

