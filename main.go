package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	firebase "firebase.google.com/go/v4"
	"github.com/gosnmp/gosnmp"
	"google.golang.org/api/option"
)

type Printer struct {
	SELB    string `json:"selb"`
	IP      string `json:"ip"`
	Status  string `json:"status"`
	Message string `json:"message"`
	TonerK  int64  `json:"tonerK"`
	TonerC  int64  `json:"tonerC"`
	TonerM  int64  `json:"tonerM"`
	TonerY  int64  `json:"tonerY"`
	Counter int64  `json:"counter"`
}

func main() {
	ctx := context.Background()
	conf := &firebase.Config{DatabaseURL: "https://dashboard-fleury-default-rtdb.firebaseio.com"}
	opt := option.WithServiceAccountFile("serviceAccountKey.json")

	app, err := firebase.NewApp(ctx, conf, opt)
	if err != nil {
		log.Fatal(err)
	}

	db, _ := app.Database(ctx)
	fmt.Println("🚀 Monitor SNMP em execução...")

	for {
		var printers map[string]interface{}
		ref := db.NewRef("printers")
		ref.Get(ctx, &printers)

		for selb, data := range printers {
			pData := data.(map[string]interface{})
			ip := pData["ip"].(string)

			// Coleta SNMP
			update := getSNMP(ip)

			// Atualiza apenas campos técnicos no Firebase
			ref.Child(selb).Update(ctx, map[string]interface{}{
				"status":  update.Status,
				"message": update.Message,
				"tonerK":  update.TonerK,
				"tonerC":  update.TonerC,
				"tonerM":  update.TonerM,
				"tonerY":  update.TonerY,
				"counter": update.Counter,
			})
			fmt.Printf("✔ [%s] Atualizado\n", selb)
		}
		time.Sleep(30 * time.Second)
	}
}

func getSNMP(ip string) Printer {
	p := Printer{Status: "Offline", Message: "Sem rede"}
	agent := &gosnmp.GoSNMP{
		Target: ip, Port: 161, Community: "public", Version: gosnmp.Version2c, Timeout: 1 * time.Second,
	}
	if err := agent.Connect(); err != nil {
		return p
	}
	defer agent.Conn.Close()

	p.Status = "Online"
	p.Message = "Conectado"

	// Contador Total (Padrão RFC + Fallback Xerox)
	counterOids := []string{
		".1.3.6.1.2.1.43.10.2.1.4.1.1",          // Standard Marker Life
		".1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1", // Xerox Billing Meter (Total Impressions)
	}
	for _, oid := range counterOids {
		res, err := agent.Get([]string{oid})
		if err == nil && len(res.Variables) > 0 {
			val := gosnmp.ToBigInt(res.Variables[0].Value).Int64()
			if val > 0 {
				p.Counter = val
				break
			}
		}
	}

	// Busca mensagem do painel (Tabela de Alertas ou Buffer do Console)
	msgOids := []string{
		".1.3.6.1.2.1.43.18.1.1.8.1.1", // prtAlertDescription (Alertas ativos)
		".1.3.6.1.2.1.43.16.5.1.2.1.1", // prtConsoleDisplayBufferText (Texto do visor)
	}

	for _, oid := range msgOids {
		msgRes, err := agent.Get([]string{oid})
		if err == nil && len(msgRes.Variables) > 0 {
			if bytes, ok := msgRes.Variables[0].Value.([]byte); ok {
				msg := strings.TrimSpace(string(bytes))
				if msg != "" {
					p.Message = msg
					break
				}
			}
		}
	}

	// Loop simplificado para níveis de toner
	oids := []string{
		".1.3.6.1.2.1.43.11.1.1.9.1.1", // K
		".1.3.6.1.2.1.43.11.1.1.9.1.2", // C
		".1.3.6.1.2.1.43.11.1.1.9.1.3", // M
		".1.3.6.1.2.1.43.11.1.1.9.1.4", // Y
	}

	for i, oid := range oids {
		r, err := agent.Get([]string{oid, strings.Replace(oid, ".9.1.", ".8.1.", 1)})
		if err == nil && len(r.Variables) == 2 {
			cur := gosnmp.ToBigInt(r.Variables[0].Value).Int64()
			max := gosnmp.ToBigInt(r.Variables[1].Value).Int64()
			perc := int64(0)
			if max > 0 {
				perc = (cur * 100) / max
			}
			switch i {
			case 0:
				p.TonerK = perc
			case 1:
				p.TonerC = perc
			case 2:
				p.TonerM = perc
			case 3:
				p.TonerY = perc
			}
		}
	}
	return p
}