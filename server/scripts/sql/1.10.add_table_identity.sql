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