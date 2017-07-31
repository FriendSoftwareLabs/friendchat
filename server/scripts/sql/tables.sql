# !!!
# !!! REMEBER TO UPDATE TABLE VERSION, OR THE PATCHER WILL CRASH
# !!!

DROP TABLE IF EXISTS `contact`;
DROP TABLE IF EXISTS `module`;
DROP TABLE IF EXISTS `account`;
DROP TABLE IF EXISTS `settings_json`;
DROP TABLE IF EXISTS `identity`;
DROP TABLE IF EXISTS `db_history`;

CREATE TABLE `account` (
	`_id` INT UNSIGNED NOT NULL auto_increment,
	`clientId` VARCHAR(255) NOT NULL UNIQUE,
	`userId` VARCHAR(255) NOT NULL,
	`name` VARCHAR(255) NOT NULL,
	`password` VARCHAR(255),
	`skipPass` BOOLEAN NOT NULL,
	`lastLogin` TIMESTAMP NULL,
	PRIMARY KEY(_id),
	CONSTRAINT UNIQUE `userId_name`( userId, name )
) ENGINE=INNODB CHARACTER SET=utf8;

CREATE TABLE `module` (
	`_id` INT NOT NULL auto_increment,
	`type` VARCHAR(255) NOT NULL,
	`clientId` VARCHAR(255) NOT NULL UNIQUE,
	`displayName` VARCHAR(255),
	`host` VARCHAR(255),
	`port` INT(5),
	`login` VARCHAR(255),
	`password` VARCHAR(255),
	`accountId` VARCHAR(255) NOT NULL,
	PRIMARY KEY (_id),
	FOREIGN KEY ( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8;

CREATE TABLE `contact` (
	`_id` INT NOT NULL auto_increment,
	`clientId` VARCHAR(255) NOT NULL UNIQUE,
	`serviceId` VARCHAR(255) NOT NULL,
	`displayName` VARCHAR(255),
	`subscribeTo` BOOLEAN NOT NULL,
	`subscribeFrom` BOOLEAN NOT NULL,
	`accountId` VARCHAR(255) NOT NULL,
	`moduleId` VARCHAR(255) NOT NULL,
	PRIMARY KEY( _id ),
	UNIQUE KEY ( clientId, accountId, moduleId ),
	FOREIGN KEY ( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	FOREIGN KEY ( moduleId ) REFERENCES module( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8;

CREATE TABLE `settings_json` (
	`_id` INT NOT NULL auto_increment,
	`settings` TEXT,
	`clientId` VARCHAR(255) NOT NULL UNIQUE,
	PRIMARY KEY( _id )
) ENGINE=INNODB CHARACTER SET=utf8;

CREATE TABLE `identity` (
	`_id` INT NOT NULL auto_increment,
	`clientId` VARCHAR(255) NOT NULL,
	`json` TEXT,
	`accountId` VARCHAR(255) NOT NULL,
	PRIMARY KEY( _id ),
	FOREIGN KEY( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8;

CREATE TABLE `db_history` (
	`_id` INT UNSIGNED NOT NULL auto_increment,
	`version` INT UNSIGNED NOT NULL,
	`patch` INT UNSIGNED NOT NULL,
	`comment` VARCHAR( 255 ) NOT NULL,
	`applied` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY( _id )
) ENGINE=INNODB CHARACTER SET=utf8;

INSERT INTO `db_history`(
	`version`,
	`patch`,
	`comment`
) VALUES (
	1,
	11,
	'table version'
);
