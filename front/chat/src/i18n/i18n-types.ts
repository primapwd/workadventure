// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */
import type { BaseTranslation as BaseTranslationType, LocalizedString, RequiredParams } from 'typesafe-i18n'

export type BaseTranslation = BaseTranslationType
export type BaseLocale = 'en-US'

export type Locales =
	| 'en-US'
	| 'fr-FR'

export type Translation = RootTranslation

export type Translations = RootTranslation

type RootTranslation = {
	/**
	 * Hi {name}! Please leave a star if you like this project: https://github.com/ivanhofer/typesafe-i18n
	 * @param {string} name
	 */
	HI: RequiredParams<'name'>
	/**
	 * Users
	 */
	users: string
	userList: {
		/**
		 * Disconnected
		 */
		disconnected: string
		/**
		 * Is on this map !
		 */
		isHere: string
		/**
		 * Is on an another map !
		 */
		isOverThere: string
		/**
		 * Teleport
		 */
		teleport: string
		/**
		 * Just look it up!
		 */
		search: string
		/**
		 * Walk to
		 */
		walkTo: string
		/**
		 * Teleporting ...
		 */
		teleporting: string
	}
	/**
	 * Connection to presence server ...
	 */
	reconnecting: string
	/**
	 * Waiting user data ...
	 */
	waitingData: string
	/**
	 * Search for user, message, channel, etc.
	 */
	search: string
	/**
	 * user online
	 */
	userOnline: string
	/**
	 * users online
	 */
	usersOnline: string
	/**
	 * Open
	 */
	open: string
	/**
	 * Me
	 */
	me: string
	ban: {
		/**
		 * Banish
		 */
		title: string
		/**
		 * Ban user {userName} from the running world. This can be cancelled from the administration.
		 * @param {unknown} userName
		 */
		content: RequiredParams<'userName'>
		/**
		 * Ban this user
		 */
		ban: string
	}
	/**
	 * Promote
	 */
	rankUp: string
	/**
	 * Retrograde
	 */
	rankDown: string
	/**
	 * Re initialize
	 */
	reinit: string
	/**
	 * test
	 */
	CONNECTING: string
}

export type TranslationFunctions = {
	/**
	 * Hi {name}! Please leave a star if you like this project: https://github.com/ivanhofer/typesafe-i18n
	 */
	HI: (arg: { name: string }) => LocalizedString
	/**
	 * Users
	 */
	users: () => LocalizedString
	userList: {
		/**
		 * Disconnected
		 */
		disconnected: () => LocalizedString
		/**
		 * Is on this map !
		 */
		isHere: () => LocalizedString
		/**
		 * Is on an another map !
		 */
		isOverThere: () => LocalizedString
		/**
		 * Teleport
		 */
		teleport: () => LocalizedString
		/**
		 * Just look it up!
		 */
		search: () => LocalizedString
		/**
		 * Walk to
		 */
		walkTo: () => LocalizedString
		/**
		 * Teleporting ...
		 */
		teleporting: () => LocalizedString
	}
	/**
	 * Connection to presence server ...
	 */
	reconnecting: () => LocalizedString
	/**
	 * Waiting user data ...
	 */
	waitingData: () => LocalizedString
	/**
	 * Search for user, message, channel, etc.
	 */
	search: () => LocalizedString
	/**
	 * user online
	 */
	userOnline: () => LocalizedString
	/**
	 * users online
	 */
	usersOnline: () => LocalizedString
	/**
	 * Open
	 */
	open: () => LocalizedString
	/**
	 * Me
	 */
	me: () => LocalizedString
	ban: {
		/**
		 * Banish
		 */
		title: () => LocalizedString
		/**
		 * Ban user {userName} from the running world. This can be cancelled from the administration.
		 */
		content: (arg: { userName: unknown }) => LocalizedString
		/**
		 * Ban this user
		 */
		ban: () => LocalizedString
	}
	/**
	 * Promote
	 */
	rankUp: () => LocalizedString
	/**
	 * Retrograde
	 */
	rankDown: () => LocalizedString
	/**
	 * Re initialize
	 */
	reinit: () => LocalizedString
	/**
	 * test
	 */
	CONNECTING: () => LocalizedString
}

export type Formatters = {}
