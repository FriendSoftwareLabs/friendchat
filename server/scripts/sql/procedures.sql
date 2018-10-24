/*
	IMPORTANT: Execute this file from the mysql cli, running it in phpMyAdmin will fail.
	This is because :phpMyAdminTrollface.jpg: and not a problem with the script itself. Must be.
*/

DELIMITER //

#
# TEST
DROP PROCEDURE IF EXISTS dummy;

#
# DROP
DROP PROCEDURE IF EXISTS purge_orphaned_settings;
DROP PROCEDURE IF EXISTS account_get;
DROP PROCEDURE IF EXISTS account_getpass;
DROP PROCEDURE IF EXISTS account_set;
DROP PROCEDURE IF EXISTS account_touch;
DROP PROCEDURE IF EXISTS account_update;
DROP PROCEDURE IF EXISTS account_remove;
DROP PROCEDURE IF EXISTS module_get;
DROP PROCEDURE IF EXISTS modules_get;
DROP PROCEDURE IF EXISTS module_set;
DROP PROCEDURE IF EXISTS module_update;
DROP PROCEDURE IF EXISTS module_remove;

# Purge settings entries that do not have a account or module parent
CREATE PROCEDURE purge_orphaned_settings()
BEGIN
	DROP TABLE IF EXISTS tmp_s;
	
	CREATE TEMPORARY TABLE tmp_s
	SELECT s.clientId
	FROM settings_json AS s
		LEFT JOIN
		(
			SELECT clientId FROM account
			UNION
			SELECT clientId FROM module
		) AS u
		ON u.clientId = s.clientId
	WHERE
		u.clientId IS NULL;
	
	DELETE
	FROM settings_json
	WHERE
	clientId IN
	(
		SELECT clientId
		FROM tmp_s
	);
	
	DROP TABLE tmp_s;
	
END//

#
# ACCOUNT

# GET
CREATE PROCEDURE account_get(
	IN `userId` VARCHAR( 191 ),
	IN `clientId` VARCHAR( 191 )
)
BEGIN

IF ( `clientId` IS NULL ) THEN
	SELECT
		a.clientId,
		a.userId,
		a.name,
		a.lastLogin,
		a.skipPass,
		s.settings
	FROM account AS a
	LEFT JOIN settings_json AS s
	ON a.clientId = s.clientId
	WHERE a.userId = `userId`
	ORDER BY a.lastLogin DESC;
ELSE
	SELECT
		a.clientId,
		a.userId,
		a.name,
		a.lastLogin,
		a.skipPass,
		s.settings
	FROM account AS a
	LEFT JOIN settings_json AS s
	ON a.clientId = s.clientId
	WHERE a.userId = `userId` AND a.clientId = `clientId`;
END IF;

END//

# GETPASS
CREATE PROCEDURE account_getpass(
	IN `userId` VARCHAR( 191 ),
	IN `name` VARCHAR( 191 )
)
BEGIN

SELECT
	a.clientId,
	a.password,
	a.skipPass
FROM account AS a
WHERE a.userId = `userId` AND a.name = `name`;

END//

#SET
CREATE PROCEDURE account_set(
	IN `clientId` VARCHAR( 191 ),
	IN `userId` VARCHAR( 191 ),
	IN `name` VARCHAR( 191 ),
	IN `password` VARCHAR( 191 ),
	IN `skipPass` BOOLEAN,
	IN `settings` TEXT
)
BEGIN

INSERT INTO account (
	`clientId`,
	`userId`,
	`name`,
	`password`,
	`skipPass`,
	`lastLogin`
) VALUES (
	`clientId`,
	`userId`,
	`name`,
	`password`,
	`skipPass`,
	null
);

INSERT INTO settings_json (
	`clientId`,
	`settings`
) VALUES (
	`clientId`,
	`settings`
);

END//


# TOUCH
CREATE PROCEDURE account_touch(
	IN `clientId` VARCHAR( 191 )
)
BEGIN

UPDATE account 
SET lastLogin = NOW()
WHERE account.clientId = `clientId`;

END//

#UPDATE
CREATE PROCEDURE account_update(
	IN `clientId` VARCHAR( 191 ),
	IN `skipPass` BOOLEAN,
	IN `settings` TEXT
)
BEGIN

DROP TABLE IF EXISTS tmp_acc_row;
CREATE TEMPORARY TABLE tmp_acc_row
SELECT a.*, s.settings FROM account AS a
LEFT JOIN settings_json AS s
ON a.clientId = s.clientId
WHERE a.clientId = `clientId`;

IF ( `skipPass` IS NULL ) THEN
	SELECT tmp_acc_row.skipPass INTO `skipPass` FROM tmp_acc_row;
END IF;

IF ( `settings` IS NULL ) THEN
	SELECT tmp_acc_row.settings INTO `settings` FROM tmp_acc_row;
END IF;

UPDATE account AS a
LEFT JOIN settings_json AS s
ON a.clientId = s.clientId
SET
a.skipPass = `skipPass`,
s.settings = `settings`
WHERE a.clientId = `clientId`;

END//

# REMOVE
CREATE PROCEDURE account_remove(
	IN `clientId` VARCHAR( 191 )
)
BEGIN

DELETE FROM account
WHERE account.clientId = `clientId`;

DELETE FROM settings_json
WHERE settings_json.clientId = `clientId`;

END//

#
# MODULE

#GET
CREATE PROCEDURE module_get(
	IN accountId VARCHAR( 191 ),
	IN clientId VARCHAR( 191 )
)
BEGIN
	SELECT m.*, sj.settings
	FROM module AS m
	LEFT JOIN settings_json AS sj
	ON m.clientId = sj.clientId
	WHERE m.accountId = accountId AND m.clientId = clientId;
END//

#GETS
# this one is plural
CREATE PROCEDURE modules_get( accountId VARCHAR( 191 ))
BEGIN
	SELECT m.*, sj.settings
	FROM module AS m
	LEFT JOIN settings_json AS sj
	ON m.clientId = sj.clientId
	WHERE m.accountId=accountId;
END//

#SET
CREATE PROCEDURE module_set(
	`accountId` VARCHAR( 191 ),
	`clientId` VARCHAR( 191 ),
	`type` VARCHAR( 191 ),
	`displayName` VARCHAR( 191 ),
	`host` VARCHAR( 191 ),
	`port` INT( 5 ),
	`login` VARCHAR( 191 ),
	`password` VARCHAR( 191 ),
	`settings` TEXT
)
BEGIN
	INSERT INTO `module` ( 
		`clientId`, 
		`type`, 
		`displayName`, 
		`host`, `port`, 
		`login`, 
		`password`, 
		`accountId` 
	) VALUES ( 
		clientId, 
		type, 
		displayName, 
		host, 
		port, 
		login, 
		password, 
		accountId 
	);
	
	INSERT INTO `settings_json` ( `clientId`, `settings` )
	VALUES ( clientId, settings );
END//

#UPDATE
CREATE PROCEDURE module_update(
	in `clientId` VARCHAR( 191 ),
	in `displayName` VARCHAR( 191 ),
	in `host` VARCHAR( 191 ),
	in `port` INT( 5 ),
	in `login` VARCHAR( 191 ),
	in `password` VARCHAR( 191 ),
	in `settings` TEXT
)
BEGIN

DROP TABLE IF EXISTS tmp_module_row;

CREATE TEMPORARY TABLE tmp_module_row
SELECT m.*, s.settings FROM module AS m
LEFT JOIN settings_json AS s
ON m.clientId = s.clientId
WHERE m.clientId = `clientId`;

IF ( `displayName` IS NULL ) THEN
	SELECT tmp_module_row.displayName INTO `displayName` FROM tmp_module_row;
END IF;

IF ( `host` IS NULL ) THEN
	SELECT tmp_module_row.host INTO `host` FROM tmp_module_row;
END IF;

IF ( `port` IS NULL ) THEN
	SELECT tmp_module_row.port INTO `port` FROM tmp_module_row;
END IF;

IF ( `login` IS NULL ) THEN
	SELECT tmp_module_row.login INTO `login` FROM tmp_module_row;
END IF;

IF ( `password` IS NULL ) THEN
	SELECT tmp_module_row.password INTO `password` FROM tmp_module_row;
END IF;

IF ( `settings` IS NULL ) THEN
	SELECT tmp_module_row.settings INTO `settings` FROM tmp_module_row;
END IF;

UPDATE module AS m
LEFT JOIN settings_json AS s
ON m.clientId = s.clientId
SET
m.displayName = `displayName`,
m.host = `host`,
m.port = `port`,
m.login = `login`,
m.password = `password`,
s.settings = `settings`
WHERE m.clientId = `clientId`;

END//

# REMOVE
CREATE PROCEDURE module_remove(
	`accountId` VARCHAR( 191 ),
	`clientId` VARCHAR( 191 )
)
BEGIN

DELETE FROM module
WHERE module.accountId = `accountId`
AND module.clientId = `clientId`;

DELETE FROM settings_json
WHERE settings_json.clientId = `clientId`;

END //

DELIMITER ;
