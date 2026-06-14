import React from "react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import WholesalerLayout from "@/components/WholesalerLayout";
import CustomerClient from "./CustomerClient";

export const dynamic = "force-dynamic";

// Force trigger reload
export default async function WholesalerCustomers() {
  const user = await getSessionUser();
  if (
    !user ||
    (user.role !== "WHOLESALER" && user.role !== "WHOLESALER_STAFF")
  ) {
    redirect("/");
  }

  let profile = null;
  const dbUser = await db.user.findUnique({
    where: { id: user.userId },
  });

  if (user.role === "WHOLESALER") {
    profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
  } else if (user.role === "WHOLESALER_STAFF" && dbUser?.wholesalerId) {
    profile = await db.wholesalerProfile.findUnique({
      where: { id: dbUser.wholesalerId },
    });
  }

  if (!profile) {
    redirect("/subscription-expired");
  }

  // Load registered customer pharmacies belonging to this wholesaler OR who have placed orders with this wholesaler
  const retailers = await db.retailerProfile.findMany({
    where: {
      OR: [
        { wholesalerId: profile.id },
        { orders: { some: { wholesalerId: profile.id } } }
      ]
    },
    include: {
      user: true,
      orders: {
        where: { wholesalerId: profile.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          b2bSettlements: true,
        },
        orderBy: { createdAt: "desc" },
      },
      wholesalerRelations: {
        where: { wholesalerId: profile.id }
      }
    },
  });

  const formattedRetailers = retailers.map(c => {
    const relation = c.wholesalerRelations?.[0];
    return {
      ...c,
      creditLimit: relation ? relation.creditLimit : c.creditLimit,
      advanceBalance: relation ? relation.advanceBalance : 0,
      wholesalerRelations: undefined,
    };
  });

  const serializedRetailers = JSON.parse(JSON.stringify(formattedRetailers));

  return (
    <WholesalerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser?.fullName,
        allowedFeatures: dbUser?.allowedFeatures,
      }}
      profile={{
        id: profile.id,
        companyName: profile.companyName,
        taxId: profile.taxId,
      }}
    >
      <CustomerClient
        customers={serializedRetailers}
        wholesalerId={profile.id}
      />
    </WholesalerLayout>
  );
}
