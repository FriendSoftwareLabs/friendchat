
# disable foreign key checks so we can update fields

SET FOREIGN_KEY_CHECKS = 0;

# upgrade fields

ALTER TABLE `account` CHANGE clientId clientId VARCHAR( 191 ) NOT NULL UNIQUE;
ALTER TABLE `account` CHANGE userId userId VARCHAR( 191 ) NOT NULL;
ALTER TABLE `account` CHANGE name name VARCHAR( 191 ) NOT NULL;
ALTER TABLE `account` CHANGE password password VARCHAR( 191 );

ALTER TABLE `module` CHANGE type type VARCHAR( 191 ) NOT NULL;
ALTER TABLE `module` CHANGE clientId clientId VARCHAR( 191 ) NOT NULL UNIQUE;
ALTER TABLE `module` CHANGE displayName displayName VARCHAR( 191 );
ALTER TABLE `module` CHANGE host host VARCHAR( 191 );
ALTER TABLE `module` CHANGE login login VARCHAR( 191 );
ALTER TABLE `module` CHANGE password password VARCHAR( 191 );
ALTER TABLE `module` CHANGE accountId accountId VARCHAR( 191 ) NOT NULL;

ALTER TABLE `contact` CHANGE clientId clientId VARCHAR( 191 ) NOT NULL UNIQUE;
ALTER TABLE `contact` CHANGE serviceId serviceId VARCHAR( 191 ) NOT NULL;
ALTER TABLE `contact` CHANGE displayName displayName VARCHAR( 191 );
ALTER TABLE `contact` CHANGE accountId accountId VARCHAR( 191 ) NOT NULL;
ALTER TABLE `contact` CHANGE moduleId moduleId VARCHAR( 191 ) NOT NULL;

ALTER TABLE `settings_json` CHANGE clientId clientId VARCHAR( 191 ) NOT NULL UNIQUE;

ALTER TABLE `identity` CHANGE clientId clientId VARCHAR( 191 ) NOT NULL;
ALTER TABLE `identity` CHANGE accountId accountId VARCHAR( 191 ) NOT NULL;

ALTER TABLE `db_history` CHANGE comment comment VARCHAR( 191 ) NOT NULL;

# upgrade tables

ALTER TABLE `account` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `module` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `contact` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `identity` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `db_history` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `settings_json` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# reenable foreign key checks

SET FOREIGN_KEY_CHECKS = 1;
