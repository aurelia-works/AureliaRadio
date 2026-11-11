/*
 * Aurelia Radio XPLM bridge — Phase 0.
 *
 * Reads standard X-Plane datarefs and streams them as JSON lines to
 * 127.0.0.1:49020. Accepts commands on 127.0.0.1:49021:
 *
 *   {"cmd":"set_com1","mhz":121.8}
 *   {"cmd":"set_standby","mhz":118.45}
 *   {"cmd":"swap_com1"}
 *
 * No panel, no traffic, no writes outside the COM datarefs yet.
 */

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#include "XPLMDataAccess.h"
#include "XPLMProcessing.h"
#include "XPLMPlugin.h"
#include "XPLMUtilities.h"

#define AR_TELEMETRY_PORT 49020
#define AR_COMMAND_PORT 49021
#define AR_PACKET_MAX 2048

static XPLMDataRef refCom1 = NULL;
static XPLMDataRef refCom1_833 = NULL;
static XPLMDataRef refStandby = NULL;
static XPLMDataRef refStandby_833 = NULL;
static XPLMDataRef refLat = NULL;
static XPLMDataRef refLon = NULL;
static XPLMDataRef refAltFt = NULL;
static XPLMDataRef refIas = NULL;
static XPLMDataRef refHdg = NULL;
static XPLMDataRef refXpdr = NULL;

static int gSocket = -1;
static struct sockaddr_in gTelemetryAddr;
static char gCommandBuffer[AR_PACKET_MAX];

static double readCom(XPLMDataRef hz833, XPLMDataRef hz10)
{
    if (hz833 != NULL) {
        return (double)XPLMGetDatai(hz833) / 1000.0;
    }
    if (hz10 != NULL) {
        return (double)XPLMGetDatai(hz10) / 100.0;
    }
    return 0.0;
}

static void setCom(XPLMDataRef hz833, XPLMDataRef hz10, double mhz)
{
    if (mhz < 118.0 || mhz > 136.990) {
        return;
    }
    if (hz833 != NULL) {
        XPLMSetDatai(hz833, (int)(mhz * 1000.0 + 0.5));
    }
    if (hz10 != NULL) {
        XPLMSetDatai(hz10, (int)(mhz * 100.0 + 0.5));
    }
}

static void swapCom(void)
{
    if (refCom1_833 != NULL && refStandby_833 != NULL) {
        int active = XPLMGetDatai(refCom1_833);
        int standby = XPLMGetDatai(refStandby_833);
        XPLMSetDatai(refCom1_833, standby);
        XPLMSetDatai(refStandby_833, active);
        return;
    }
    if (refCom1 != NULL && refStandby != NULL) {
        int active = XPLMGetDatai(refCom1);
        int standby = XPLMGetDatai(refStandby);
        XPLMSetDatai(refCom1, standby);
        XPLMSetDatai(refStandby, active);
    }
}

static double numberAfter(const char *packet, const char *key)
{
    const char *found = strstr(packet, key);
    if (found == NULL) {
        return -1.0;
    }
    found = strchr(found, ':');
    if (found == NULL) {
        return -1.0;
    }
    return strtod(found + 1, NULL);
}

static void handleCommand(const char *packet)
{
    if (strstr(packet, "\"swap_com1\"") != NULL) {
        swapCom();
        return;
    }
    if (strstr(packet, "\"set_com1\"") != NULL) {
        setCom(refCom1_833, refCom1, numberAfter(packet, "\"mhz\""));
        return;
    }
    if (strstr(packet, "\"set_standby\"") != NULL) {
        setCom(refStandby_833, refStandby, numberAfter(packet, "\"mhz\""));
    }
}

static void sendTelemetry(void)
{
    if (gSocket < 0) {
        return;
    }

    const double com1 = readCom(refCom1_833, refCom1);
    const double standby = readCom(refStandby_833, refStandby);
    const double lat = refLat != NULL ? XPLMGetDatad(refLat) : 0.0;
    const double lon = refLon != NULL ? XPLMGetDatad(refLon) : 0.0;
    const double alt = refAltFt != NULL ? (double)XPLMGetDataf(refAltFt) : 0.0;
    const double ias = refIas != NULL ? (double)XPLMGetDataf(refIas) : 0.0;
    const double hdg = refHdg != NULL ? (double)XPLMGetDataf(refHdg) : 0.0;
    const int xpdr = refXpdr != NULL ? XPLMGetDatai(refXpdr) : 0;

    char json[512];
    const int len = snprintf(
        json, sizeof(json),
        "{\"com1\":%.3f,\"standby\":%.3f,\"lat\":%.6f,\"lon\":%.6f,"
        "\"alt_ft\":%.0f,\"ias\":%.1f,\"hdg\":%.1f,\"xpdr\":%d}\n",
        com1, standby, lat, lon, alt, ias, hdg, xpdr);
    if (len > 0) {
        sendto(gSocket, json, (size_t)len, 0, (struct sockaddr *)&gTelemetryAddr, sizeof(gTelemetryAddr));
    }
}

static float flightLoop(float elapsedSinceLastCall, float elapsedTimeSinceLastFlightLoop,
                        int counter, void *refcon)
{
    (void)elapsedSinceLastCall;
    (void)elapsedTimeSinceLastFlightLoop;
    (void)counter;
    (void)refcon;

    if (gSocket >= 0) {
        for (;;) {
            struct sockaddr_in from;
            socklen_t fromLen = sizeof(from);
            const ssize_t received = recvfrom(gSocket, gCommandBuffer, sizeof(gCommandBuffer) - 1, 0,
                                              (struct sockaddr *)&from, &fromLen);
            if (received <= 0) {
                break;
            }
            gCommandBuffer[received] = '\0';
            handleCommand(gCommandBuffer);
        }
    }

    sendTelemetry();
    return 0.25f;
}

PLUGIN_API int XPluginStart(char *outName, char *outSig, char *outDesc)
{
    strcpy(outName, "Aurelia Radio");
    strcpy(outSig, "com.aurelia.radio.bridge");
    strcpy(outDesc, "Aurelia Radio telemetry and COM bridge");

    refCom1_833 = XPLMFindDataRef("sim/cockpit2/radios/actuators/com1_frequency_hz_833");
    refCom1 = XPLMFindDataRef("sim/cockpit2/radios/actuators/com1_frequency_hz");
    refStandby_833 = XPLMFindDataRef("sim/cockpit2/radios/actuators/com1_standby_frequency_hz_833");
    refStandby = XPLMFindDataRef("sim/cockpit2/radios/actuators/com1_standby_frequency_hz");
    refLat = XPLMFindDataRef("sim/flightmodel/position/latitude");
    refLon = XPLMFindDataRef("sim/flightmodel/position/longitude");
    refAltFt = XPLMFindDataRef("sim/cockpit2/gauges/indicators/altitude_ft_pilot");
    refIas = XPLMFindDataRef("sim/flightmodel/position/indicated_airspeed");
    refHdg = XPLMFindDataRef("sim/flightmodel/position/psi");
    refXpdr = XPLMFindDataRef("sim/cockpit2/radios/actuators/transponder_code");

    gSocket = socket(AF_INET, SOCK_DGRAM, 0);
    if (gSocket >= 0) {
        const int flags = fcntl(gSocket, F_GETFL, 0);
        fcntl(gSocket, F_SETFL, flags | O_NONBLOCK);

        struct sockaddr_in address;
        memset(&address, 0, sizeof(address));
        address.sin_family = AF_INET;
        address.sin_port = htons(AR_COMMAND_PORT);
        address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        if (bind(gSocket, (struct sockaddr *)&address, sizeof(address)) != 0) {
            XPLMDebugString("AureliaRadio: could not bind command port\n");
            close(gSocket);
            gSocket = -1;
        }

        memset(&gTelemetryAddr, 0, sizeof(gTelemetryAddr));
        gTelemetryAddr.sin_family = AF_INET;
        gTelemetryAddr.sin_port = htons(AR_TELEMETRY_PORT);
        gTelemetryAddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    }

    XPLMRegisterFlightLoopCallback(flightLoop, 0.25f, NULL);
    XPLMDebugString("AureliaRadio: loaded\n");
    return 1;
}

PLUGIN_API void XPluginStop(void)
{
    XPLMUnregisterFlightLoopCallback(flightLoop, NULL);
    if (gSocket >= 0) {
        close(gSocket);
        gSocket = -1;
    }
    XPLMDebugString("AureliaRadio: stopped\n");
}

PLUGIN_API int XPluginEnable(void)
{
    return 1;
}

PLUGIN_API void XPluginDisable(void)
{
}

PLUGIN_API void XPluginReceiveMessage(XPLMPluginID inFrom, int inMessage, void *inParam)
{
    (void)inFrom;
    (void)inMessage;
    (void)inParam;
}
