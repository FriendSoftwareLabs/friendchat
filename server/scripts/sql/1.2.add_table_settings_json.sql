DROP TABLE IF EXISTS `settings_json`;

CREATE TABLE `settings_json` (
	`_id` INT NOT NULL auto_increment,
	`settings` TEXT,
	`clientId` VARCHAR(255) NOT NULL UNIQUE,
	PRIMARY KEY( _id )
) ENGINE=INNODB CHARACTER SET=utf8;

DELETE FROM settings_json;

INSERT INTO settings_json ( clientId, settings )
SELECT account.clientId, ''
FROM account;

INSERT INTO settings_json ( clientId, settings )
SELECT module.clientId, ''
FROM module;