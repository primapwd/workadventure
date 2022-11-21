import type { Readable, Writable } from "svelte/store";
import { get, writable } from "svelte/store";
import { v4 as uuid } from "uuid";
import { userStore } from "../Stores/LocalUserStore";
import { mediaManager, NotificationType } from "../Media/MediaManager";
import { availabilityStatusStore } from "../Stores/ChatStore";
import { AbstractRoom, Message, MessageType, User } from "./AbstractRoom";
import { XmppClient } from "./XmppClient";
import * as StanzaProtocol from "stanza/protocol";
import { WaLink, WaReceivedReactions, WaUserInfo } from "./Lib/Plugin";
import { ParsedJID } from "stanza/JID";
import { ChatStateMessage, JID } from "stanza";
import { ChatState, MUCAffiliation } from "stanza/Constants";
import { derived } from "svelte/store";
import * as StanzaConstants from "stanza/Constants";

const _VERBOSE = false;

export type UserList = Map<string, User>;
export type UsersStore = Readable<UserList>;

export class MucRoom extends AbstractRoom {
    private showDisabledLoadOlderMessagesStore: Writable<boolean>;
    private description: string = "";
    private loadingSubscribers: Writable<boolean>;

    constructor(
        xmppClient: XmppClient,
        public readonly name: string,
        protected roomJid: ParsedJID,
        public type: string,
        public subscribe: boolean
    ) {
        super(xmppClient, _VERBOSE);
        this.showDisabledLoadOlderMessagesStore = writable<boolean>(false);
        this.loadingSubscribers = writable<boolean>(false);
        this.readyStore = writable<boolean>(type === "default");
    }

    private console(text: string) {
        if (_VERBOSE) {
            console.warn(`[XMPP]%c[MR](${this.name})%c ${text}`, "color: LightSkyBlue;", "color: inherit;");
        }
    }

    get recipient(): string {
        return JID.create({
            local: this.roomJid.local,
            domain: this.roomJid.domain,
            resource: this.xmppClient.getMyResource(),
        });
    }
    get rawRecipient(): string {
        return this.roomJid.full;
    }
    get url(): string {
        return this.roomJid.bare;
    }
    get chatType(): StanzaConstants.MessageType {
        return "groupchat";
    }

    public getUserByJid(jid: string): User {
        let user = undefined;
        get(this.presenceStore).forEach((user_, key) => {
            // WORKAROUND BECAUSE WE DON'T SEND THE JID FROM THE OTHER USERS IN THE FRONT, ONLY THE UUID AND JID IS CONSTRUCT FROM THE UUID
            if (JID.parse(key).local == jid || JID.parse(key).local == JID.parse(jid).local) {
                user = user_;
            }
        });
        if (!user) {
            throw new Error("No user found for this JID");
        }
        return user;
    }

    public reInitialize() {
        // Destroy room in ejabberd
        void this.sendDestroy();
        // Recreate room in ejabberd
        //setTimeout(() => this.sendPresence(), 100);
        // Tell all users to subscribe to it
        //setTimeout(() => this.xmppClient.getConnection().emitJoinMucRoom(this.name, this.type, this.roomJid.local), 200);
    }

    public connect() {
        this.sendPresence(true);
    }

    // Functions used to send message to the server
    public sendPresence(first: boolean = false) {
        super.sendPresence(first);
        this.console(`>> ${first ? "First " : ""}Presence sent`);
    }
    public sendDisconnect() {
        if (this.closed) {
            this.xmppClient.removeMucRoom(this);
            return;
        }
        void this.xmppClient.socket.leaveRoom(this.recipient);
        this.console(">> Disconnect sent");
        this.xmppClient.removeMucRoom(this);
    }
    private async sendRequestAllSubscribers() {
        if (this.closed) {
            return;
        }
        const iqId = uuid();
        this.subscriptions.set("subscriptions", iqId);
        this.loadingSubscribers.set(true);

        // await this.xmppClient.socket.getRoomMembers(this.url);
        try {
            this.console(">> Get all subscribers sent");
            const response = await this.xmppClient.socket.sendIQ({
                type: "get",
                to: this.url,
                subscriptions: { usersNick: [], usersJid: [] },
            });
            this.console("<< Get all subscribers received");
            response.subscriptions.usersJid.forEach((userJid, i) => {
                if (![...get(this.presenceStore)].find(([_userJid, _]) => _userJid.includes(userJid))) {
                    this.addUserInactive(userJid, response.subscriptions.usersNick[i]);
                }
            });
        } catch (e) {
            console.error("sendRequestAllSubscribers => error", e);
        }
        this.loadingSubscribers.set(false);
    }
    public sendRankUp(userJID: string) {
        void this.sendAffiliate("admin", userJID);
    }
    public sendRankDown(userJID: string) {
        void this.sendAffiliate("none", userJID);
    }
    private async sendAffiliate(type: MUCAffiliation, userJID: string) {
        if (this.closed) {
            return;
        }
        await this.xmppClient.socket.setRoomAffiliation(this.roomJid.bare, userJID, type, "Made by an administrator");
        this.console(">> Affiliation sent");
    }
    public sendBan(userJID: string, name: string, playUri: string) {
        if (this.closed) {
            return;
        }
        console.warn("Implement the ban method to send the message to the front > pusher (> admin)", {
            userJID,
            name,
            playUri,
        });
        void this.sendAffiliate("outcast", userJID);
        //this.xmppClient.getConnection().emitBanUserByUuid(playUri, userJID.local, name, "Test message de ban");
        this.console(">> Ban user message sent");
    }
    public sendChatState(state: ChatState) {
        if (this.closed) {
            return;
        }
        this.xmppClient.socket.sendMessage({
            type: "groupchat",
            to: this.rawRecipient,
            chatState: state,
            jid: this.xmppClient.getMyPersonalJID(),
        });
        this.console(">> Chat state sent");
    }
    public sendMessage(text: string, messageReply?: Message) {
        super.sendMessage(text, messageReply);
        this.console(">> Message sent");
    }
    public sendRemoveMessage(messageId: string) {
        if (this.closed) {
            return;
        }
        this.xmppClient.socket.sendMessage({
            type: "groupchat",
            to: this.rawRecipient,
            id: uuid(),
            jid: this.xmppClient.getMyPersonalJID(),
            body: "",
            remove: {
                id: messageId,
            },
        });
        this.console(">> Remove message sent");
    }
    public sendReactionMessage(emojiTargeted: string, messageId: string) {
        super.sendReactionMessage(emojiTargeted, messageId);
        this.console(">> Reaction message sent");
    }
    public sendDestroy() {
        if (this.closed) {
            return;
        }
        const destroyId = uuid();
        this.subscriptions.set("destroy", destroyId);
        this.console(">> Destroy room sent");
        this.readyStore.set(false);
        try {
            void this.xmppClient.socket.destroyRoom(this.rawRecipient, {
                reason: `Re initialisation by administrator (${destroyId})`,
            });
        } catch (e) {
            console.error("Error on sendDestroy", e);
            this.subscriptions.delete("destroy");
            this.readyStore.set(true);
        }
    }
    public async sendRetrieveLastMessages(max: number = 50) {
        if (this.closed) {
            return;
        }
        const firstMessage = [...get(this.messageStore).values()]
            .sort((a, b) => a.time.getTime() - b.time.getTime())
            .shift();
        this.loadingStore.set(true);
        const now = new Date();
        this.console(">> Retrieve last messages sent");
        const response = await this.xmppClient.socket.searchHistory(this.roomJid.bare, {
            version: "2",
            form: {
                type: "submit",
                fields: [
                    {
                        name: "FORM_TYPE",
                        type: "hidden",
                        value: "urn:xmpp:mam:2",
                    },
                    {
                        name: "end",
                        value: firstMessage ? firstMessage.time.toISOString() : now.toISOString(),
                    },
                ],
            },
            paging: {
                max,
            },
        });
        this.console("<< Retrieve last messages received");
        if (response.paging && response.paging.count !== undefined) {
            response.results?.forEach((result) => {
                if (result.item.message) {
                    this.onMessage(result.item.message as StanzaProtocol.ReceivedMessage, result.item.delay);
                }
            });
            if (response.paging.count < 50) {
                this.canLoadOlderMessagesStore.set(false);
            }
        }
        this.loadingStore.set(false);
    }

    // Function used to interpret message from the server
    onMessage(receivedMessage: StanzaProtocol.ReceivedMessage, delay: StanzaProtocol.Delay | null = null): boolean {
        if (!receivedMessage.jid) {
            throw new Error("No JID set for the message");
        } else if (!receivedMessage.id) {
            throw new Error("No id set for the message");
        }
        let response = false;
        if (receivedMessage.hasSubject === true) {
            // If subject message, we do nothing for the moment
            response = true;
        } else {
            this.console("<< Message received");
            let date = new Date();
            if (delay) {
                // Only in case where the message received is an archive (a message automatically sent by the server when joining a room)
                date = new Date(delay.timestamp);
            }
            this.messageStore.update((messages) => {
                const thisMessage = messages.get(receivedMessage.id ?? "");
                if (thisMessage) {
                    this.updateLastMessageSeen();
                    messages.set(thisMessage.id, { ...thisMessage, delivered: true, error: false });
                    response = true;
                } else if (receivedMessage.remove) {
                    const removeId = receivedMessage.remove.id;
                    this.deletedMessagesStore.update((deletedMessages) => [...deletedMessages, removeId]);
                    response = true;
                } else {
                    if (date !== null && date > this.lastMessageSeen && !delay) {
                        this.countMessagesToSee.update((last) => last + 1);
                        if (/*get(activeThreadStore) !== this ||*/ get(availabilityStatusStore) !== 1) {
                            if (receivedMessage.nick) {
                                mediaManager.playNewMessageNotification();
                                mediaManager.createNotification(
                                    receivedMessage.nick,
                                    NotificationType.message,
                                    this.name
                                );
                            }
                        }
                    }

                    const received = JID.parse(receivedMessage.jid);

                    if (received && receivedMessage.jid && receivedMessage.id) {
                        const message: Message = {
                            name: received.resource ?? "unknown",
                            jid: JID.create({
                                local: received.local,
                                domain: received.domain,
                                resource: JID.parse(receivedMessage.from).resource,
                            }),
                            body: receivedMessage.body ?? "",
                            time: date,
                            id: receivedMessage.id,
                            delivered: true,
                            error: false,
                            from: receivedMessage.from,
                            type: receivedMessage.messageReply ? MessageType.message : MessageType.reply,
                            links: receivedMessage.links as WaLink[],
                            targetMessageReply: receivedMessage.messageReply
                                ? {
                                      id: receivedMessage.messageReply.id,
                                      senderName: receivedMessage.messageReply.senderName,
                                      body: receivedMessage.messageReply.body,
                                      links: receivedMessage.messageReply.links
                                          ? JSON.parse(receivedMessage.messageReply.links)
                                          : undefined,
                                  }
                                : undefined,
                            reactionsMessage: this.reactions(receivedMessage.id),
                        };
                        messages.set(receivedMessage.id, message);
                        response = true;
                    } else {
                        console.error("Message format is not good", {
                            received: !!received,
                            jid: !!receivedMessage.jid,
                            body: !!receivedMessage.body,
                            id: !!receivedMessage.id,
                        });
                    }
                }
                return messages;
            });
        }
        return response;
    }
    onReactions(receivedMessage: WaReceivedReactions) {
        if (!receivedMessage.jid) {
            throw new Error("No JID set for the message");
        }

        this.console("<< Reaction message received");
        this.toggleReactionsMessage(
            receivedMessage.jid,
            receivedMessage.reactions.id,
            receivedMessage.reactions.reaction
        );
        return true;
    }
    onChatState(chatState: ChatStateMessage): boolean {
        this.console("<< Chat state received");
        if (!chatState.jid) {
            throw new Error("No jid");
        }
        const from = JID.parse(chatState.jid);
        this.updateChatState(from, chatState.chatState as ChatState);
        return true;
    }
    onPresence(presence: StanzaProtocol.ReceivedPresence): boolean {
        this.console("<< Presence received");
        let response = false;

        if (presence.id) {
            // If last registered presence received
            if (this.subscriptions.get("firstPresence") === presence.id) {
                this.subscriptions.delete("firstPresence");
                this.readyStore.set(true);
                this.closed = false;
                this.sendUserInfo();
                if (this.type === "live") {
                    void this.sendRetrieveLastMessages(20);
                }
                if (userStore.get().isLogged && this.subscribe && this.type === "default") {
                    void this.sendRequestAllSubscribers();
                }
            } else if (this.subscriptions.get("firstSubscribe") === presence.id) {
                this.subscriptions.delete("firstSubscribe");
                this.closed = false;
            }
        }
        const from = JID.parse(presence.from);
        if (!from.resource) {
            // Signify that this presence is coming from the room and not from a user
            if (presence.type === "unavailable") {
                this.readyStore.set(false);
                //this.xmppClient.removeMuc(this);
                response = true;
            }
        } else {
            if (presence.userInfo) {
                this.updateUserInfo(presence.userInfo);
                response = true;
            }
            const muc = presence.muc as StanzaProtocol.MUCInfo;
            if (muc && muc.jid) {
                this.updateActive(JID.parse(muc.jid), presence.type !== "unavailable");
                if (muc.role) {
                    this.updateRole(JID.parse(muc.jid), muc.role);
                }
                response = true;
            }
        }

        const muc = presence.muc as StanzaProtocol.MUCInfo;
        if (muc && muc.action === "destroy") {
            if (muc.destroy?.reason?.includes("Re initialisation by administrator")) {
                this.subscriptions.clear();
                if (
                    this.subscriptions.has("destroy") &&
                    muc.destroy?.reason?.includes(this.subscriptions.get("destroy") ?? "unknown")
                ) {
                    this.sendPresence(true);
                } else {
                    setTimeout(() => this.sendPresence(true), 1000);
                }
            } else {
                this.closed = true;
            }
            response = true;
        }

        return response;
    }

    // Update presenceStore
    updateActive(jid: ParsedJID, active: boolean) {
        this.presenceStore.update((presenceStore: UserList) => {
            const user = presenceStore.get(jid.full);
            if (user) {
                if (
                    !active &&
                    (!user.isMember ||
                        [...presenceStore.keys()].filter((userJid) => userJid.includes(jid.bare)).length > 1)
                ) {
                    presenceStore.delete(jid.full);
                } else {
                    presenceStore.set(jid.full, { ...user, active });
                }
            }
            return presenceStore;
        });
    }
    updateRole(jid: ParsedJID, role: string) {
        this.presenceStore.update((presenceStore: UserList) => {
            const user = presenceStore.get(jid.full);
            if (user) {
                presenceStore.set(jid.full, { ...user, role, isAdmin: ["admin", "moderator", "owner"].includes(role) });
            }
            return presenceStore;
        });
    }
    updateChatState(jid: ParsedJID, state: ChatState) {
        this.presenceStore.update((presenceStore: UserList) => {
            const user = presenceStore.get(jid.full);
            if (user) {
                presenceStore.set(jid.full, { ...user, chatState: state });
            }
            return presenceStore;
        });
    }
    updateUserInfo(userInfo: WaUserInfo) {
        this.presenceStore.update((presenceStore: UserList) => {
            const userJID = JID.parse(userInfo.jid);
            const user = presenceStore.get(userJID.full);
            if (user) {
                presenceStore.set(userJID.full, {
                    ...user,
                    jid: userJID.full,
                    name: userInfo.name,
                    playUri: userInfo.roomPlayUri,
                    roomName: userInfo.roomName,
                    uuid: userInfo.userUuid,
                    color: userInfo.userColor,
                    woka: userInfo.userWoka,
                    isMember: userInfo.userIsMember,
                    isInSameMap: userInfo.roomPlayUri === userStore.get().playUri,
                    availabilityStatus: userInfo.userAvailabilityStatus,
                    visitCardUrl: userInfo.userVisitCardUrl,
                });
            } else {
                presenceStore.set(userJID.full, {
                    jid: userJID.full,
                    name: userInfo.name,
                    active: true,
                    isMe: this.xmppClient.getMyJID() === userJID.full,
                    playUri: userInfo.roomPlayUri,
                    roomName: userInfo.roomName,
                    uuid: userInfo.userUuid,
                    color: userInfo.userColor,
                    woka: userInfo.userWoka,
                    isMember: userInfo.userIsMember,
                    isInSameMap: userInfo.roomPlayUri === userStore.get().playUri,
                    availabilityStatus: userInfo.userAvailabilityStatus,
                    visitCardUrl: userInfo.userVisitCardUrl,
                });
            }
            return presenceStore;
        });
    }
    addUserInactive(userJid: string, nickname: string) {
        this.presenceStore.update((presenceStore: UserList) => {
            const userJID = JID.parse(userJid);
            const user = presenceStore.get(userJID.full);
            if (!user) {
                presenceStore.set(userJid, {
                    jid: userJid,
                    name: nickname,
                    active: false,
                    isMe: this.xmppClient.getMyJID() === userJid,
                    isMember: true,
                });
            }
            return presenceStore;
        });
    }

    // Update reaction and messages
    public sendBack(idMessage: string): boolean {
        throw new Error("Not implemented yet");
        // this.messageStore.update((messages) => {
        //     this.sendMessage(messages.find((message) => message.id === idMessage)?.body ?? "");
        //     return messages.filter((message) => message.id !== idMessage);
        // });
    }

    // Get all stores
    public getLoadingSubscribersStore() {
        return this.loadingSubscribers;
    }
    public getShowDisabledLoadOlderMessagesStore() {
        return this.showDisabledLoadOlderMessagesStore;
    }
    public getMe() {
        return derived(this.presenceStore, ($presenceStore) => $presenceStore.get(this.myJID));
    }
}
