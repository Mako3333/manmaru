"use client";

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TabItem {
    id: string;
    label: string;
}

interface TabsContainerProps {
    tabList: TabItem[];
    contentMap: Record<string, React.ReactNode>;
    defaultTab?: string;
}

export default function TabsContainer({ tabList, contentMap, defaultTab }: TabsContainerProps) {
    const [activeTab, setActiveTab] = useState<string>(defaultTab || tabList[0].id);

    return (
        <Tabs
            defaultValue={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
        >
            <TabsList className="grid grid-cols-4 w-full">
                {tabList.map((tab) => (
                    <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={`text-sm py-2 ${activeTab === tab.id ? 'font-medium' : ''}`}
                    >
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>

            {tabList.map((tab) => (
                <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className="mt-4"
                >
                    {contentMap[tab.id]}
                </TabsContent>
            ))}
        </Tabs>
    );
} 