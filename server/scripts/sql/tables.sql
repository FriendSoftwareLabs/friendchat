# !!!
# !!! REMEBER TO UPDATE TABLE VERSION, OR THE PATCHER WILL CRASH
# !!!

ALTER DATABASE CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `contact`;
DROP TABLE IF EXISTS `module`;
DROP TABLE IF EXISTS `account`;
DROP TABLE IF EXISTS `settings_json`;
DROP TABLE IF EXISTS `identity`;
DROP TABLE IF EXISTS `db_history`;

CREATE TABLE `account` (
	`_id`       INT UNSIGNED NOT NULL auto_increment,
	`clientId`  VARCHAR(191) NOT NULL UNIQUE,
	`userId`    VARCHAR(191) NOT NULL,
	`name`      VARCHAR(191) NOT NULL,
	`password`  VARCHAR(191),
	`skipPass`  BOOLEAN NOT NULL,
	`lastLogin` TIMESTAMP NULL,
	PRIMARY KEY(_id),
	CONSTRAINT UNIQUE `userId_name`( userId, name )
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `module` (
	`_id`         INT NOT NULL auto_increment,
	`type`        VARCHAR(191) NOT NULL,
	`clientId`    VARCHAR(191) NOT NULL UNIQUE,
	`displayName` VARCHAR(191),
	`host`        VARCHAR(191),
	`port`        INT(5),
	`login`       VARCHAR(191),
	`password`    VARCHAR(191),
	`accountId`   VARCHAR(191) NOT NULL,
	PRIMARY KEY (_id),
	FOREIGN KEY ( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contact` (
	`_id`           INT NOT NULL auto_increment,
	`clientId`      VARCHAR(191) NOT NULL UNIQUE,
	`serviceId`     VARCHAR(191) NOT NULL,
	`displayName`   VARCHAR(191),
	`subscribeTo`   BOOLEAN NOT NULL,
	`subscribeFrom` BOOLEAN NOT NULL,
	`accountId`     VARCHAR(191) NOT NULL,
	`moduleId`      VARCHAR(191) NOT NULL,
	PRIMARY KEY( _id ),
	UNIQUE KEY ( clientId, accountId, moduleId ),
	FOREIGN KEY ( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	FOREIGN KEY ( moduleId ) REFERENCES module( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `settings_json` (
	`_id`      INT NOT NULL auto_increment,
	`settings` TEXT,
	`clientId` VARCHAR(191) NOT NULL UNIQUE,
	PRIMARY KEY( _id )
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `identity` (
	`_id`       INT NOT NULL auto_increment,
	`clientId`  VARCHAR(191) NOT NULL,
	`json`      TEXT,
	`accountId` VARCHAR(191) NOT NULL,
	PRIMARY KEY( _id ),
	FOREIGN KEY( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `db_history` (
	`_id`     INT UNSIGNED NOT NULL auto_increment,
	`version` INT UNSIGNED NOT NULL,
	`patch`   INT UNSIGNED NOT NULL,
	`comment` VARCHAR(191) NOT NULL,
	`applied` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY( _id )
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `db_history`(
	`version`,
	`patch`,
	`comment`
) VALUES (
	1,
	12,
	'table version'
);
