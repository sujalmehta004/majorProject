import React from "react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import WholesalerLayout from "@/components/WholesalerLayout";
import SuppliersClient from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function WholesalerSuppliers() {
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

  // Load all registered suppliers for the wholesaler
  const suppliers = await db.supplier.findMany({
    where: { wholesalerId: profile.id },
    include: {
      batches: {
        include: {
          product: true
        }
      },
      bills: {
        include: {
          settlements: true
        },
        orderBy: { billDate: 'desc' }
      }
    },
    orderBy: { name: 'asc' },
  });

  // Load products so we can select them when registering supplier bills or batching
  const products = await db.product.findMany({
    where: { wholesalerId: profile.id },
    orderBy: { name: 'asc' }
  });

  const serializedSuppliers = JSON.parse(JSON.stringify(suppliers));
  const serializedProducts = JSON.parse(JSON.stringify(products));

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
      <SuppliersClient
        initialSuppliers={serializedSuppliers}
        products={serializedProducts}
        wholesalerId={profile.id}
      />
    </WholesalerLayout>
  );
}
