CREATE TABLE `activity` (
	`_id`       INT NOT NULL auto_increment,
	`clientId`  VARCHAR(191) NOT NULL,
	`timestamp` BIGINT NOT NULL,
	`event`     TEXT,
	`accountId` VARCHAR(191) NOT NULL,
	PRIMARY KEY( _id ),
	UNIQUE KEY ( clientId, accountId ),
	FOREIGN KEY( accountId ) REFERENCES account( clientId )
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=INNODB CHARACTER SET=utf8mb4 COLLATE utf8mb4_unicode_ci;